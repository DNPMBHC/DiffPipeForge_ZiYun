import http.server
import json
import os
import sys
import subprocess
import threading
import socketserver
import shutil
from datetime import datetime
from urllib.parse import urlparse, parse_qs

PORT = 5001
APP_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_FILE = os.path.join(APP_ROOT_DIR, 'settings.json')

class IPCHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/ipc':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            channel = data.get('channel')
            args = data.get('args', [])
            
            print(f"[Bridge] Received IPC invoke: {channel}")
            
            result = self.handle_ipc(channel, args)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
        else:
            self.send_error(404)

    def handle_ipc(self, channel, args):
        # Implementation of core Electron IPC handlers
        if channel == 'get-language':
            settings = self.load_settings()
            return settings.get('language', 'zh')

        elif channel == 'set-language':
            settings = self.load_settings()
            settings['language'] = args[0] if args else 'zh'
            self.save_settings(settings)
            return {"success": True}
        
        elif channel == 'get-theme':
            settings = self.load_settings()
            return settings.get('theme', 'dark')
        
        elif channel == 'get-recent-projects':
            settings = self.load_settings()
            return settings.get('recentProjects', [])

        elif channel == 'add-recent-project':
            project = args[0]
            settings = self.load_settings()
            recent = settings.get('recentProjects', [])
            # Filter out existing path
            recent = [p for p in recent if p['path'] != project['path']]
            recent.insert(0, project)
            settings['recentProjects'] = recent[:10]
            self.save_settings(settings)
            return settings['recentProjects']
        
        elif channel == 'get-paths':
            return {
                "projectRoot": APP_ROOT_DIR,
                "outputDir": os.path.join(APP_ROOT_DIR, 'output')
            }
            
        elif channel == 'get-platform':
            return sys.platform

        elif channel == 'read-file':
            path = args[0]
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                return None

        elif channel == 'write-file' or channel == 'save-file':
            path, content = args[0], args[1]
            try:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return True
            except:
                return False

        elif channel == 'ensure-dir':
            path = args[0]
            try:
                os.makedirs(path, exist_ok=True)
                return True
            except:
                return False

        elif channel == 'read-project-folder':
            folder_path = args[0]
            result = {}
            mapping = {
                'dataset.toml': 'datasetConfig',
                'evaldataset.toml': 'evalDatasetConfig',
                'trainconfig.toml': 'trainConfig'
            }
            for filename, key in mapping.items():
                p = os.path.join(folder_path, filename)
                if os.path.exists(p):
                    try:
                        with open(p, 'r', encoding='utf-8') as f:
                            result[key] = f.read()
                    except: pass
            return result

        elif channel == 'create-new-project':
            path = self.create_date_folder()
            return {"success": True, "path": path}

        elif channel == 'copy-folder-configs-to-date':
            source_folder = args[0].get('sourceFolderPath') if args else None
            output_folder = self.create_date_folder()
            if source_folder and os.path.isdir(source_folder):
                for filename in ('trainconfig.toml', 'dataset.toml', 'evaldataset.toml'):
                    source_path = os.path.join(source_folder, filename)
                    if os.path.exists(source_path):
                        shutil.copy2(source_path, os.path.join(output_folder, filename))
            return {"success": True, "outputFolder": output_folder}

        elif channel == 'copy-to-date-folder':
            payload = args[0] if args else {}
            source_path = payload.get('sourcePath')
            filename = payload.get('filename') or os.path.basename(source_path or '')
            output_folder = self.create_date_folder()
            target_path = os.path.join(output_folder, filename)
            if source_path and os.path.exists(source_path):
                shutil.copy2(source_path, target_path)
                return {"success": True, "path": target_path}
            return {"success": False, "error": "Source file not found"}

        elif channel == 'save-to-date-folder':
            payload = args[0] if args else {}
            output_folder = self.create_date_folder()
            target_path = os.path.join(output_folder, payload.get('filename', 'file.txt'))
            with open(target_path, 'w', encoding='utf-8') as f:
                f.write(payload.get('content', ''))
            return {"success": True, "path": target_path}

        elif channel == 'delete-project-folder':
            project_path = args[0] if args else None
            if project_path and os.path.isdir(project_path):
                shutil.rmtree(project_path)
            settings = self.load_settings()
            recent = [p for p in settings.get('recentProjects', []) if p.get('path') != project_path]
            settings['recentProjects'] = recent
            self.save_settings(settings)
            return {"success": True, "projects": recent}

        elif channel == 'dialog:openFile':
            return {"canceled": True, "filePaths": []}

        elif channel == 'set-session-folder':
            # In browser mode, we don't have a global session state in Python yet
            # but we can return success
            return True

        elif channel == 'get-python-status':
            # Basic info
            return {
                "path": sys.executable,
                "displayName": "Python (Web Bridge)",
                "status": "ready",
                "isInternal": False,
                "availableEnvs": []
            }

        elif channel == 'run-backend':
            return {"status": "NOT_IMPLEMENTED", "message": "Backend streaming not supported in simple bridge"}

        return {"error": f"Unknown channel: {channel}"}

    def create_date_folder(self):
        timestamp = datetime.now().strftime('%Y%m%d_%H-%M-%S')
        folder_path = os.path.join(APP_ROOT_DIR, 'output', timestamp)
        os.makedirs(folder_path, exist_ok=True)
        return folder_path

    def save_settings(self, settings):
        try:
            with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2)
        except:
            pass


    def load_settings(self):
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {}

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Handle requests in a separate thread."""
    daemon_threads = True

def run_server():
    server_address = ('', PORT)
    httpd = ThreadedHTTPServer(server_address, IPCHandler)
    print(f"Starting Multi-threaded Web Bridge on port {PORT}...")
    httpd.serve_forever()

if __name__ == "__main__":
    if not os.path.exists(os.path.join(APP_ROOT_DIR, 'logs')):
        os.makedirs(os.path.join(APP_ROOT_DIR, 'logs'))
    run_server()
