export class FTPHandler {
    constructor() {
        this.isConnected = false;
        this.connectionData = null;
    }

    async connect(form) {
        try {
            const formData = new FormData(form);
            
            // Add server type and port
            const serverType = formData.get('type') || 'ftp';
            const port = formData.get('port') || (serverType === 'ftps' ? '990' : '21');
            
            // Ensure path starts with /
            let path = formData.get('path') || '/Sandbox_config.sbc';
            if (!path.startsWith('/')) {
                path = '/' + path;
            }

            // Update form data
            formData.set('path', path);
            formData.set('port', port);
            formData.append('action', 'connect');

            const response = await fetch('ftp-handler.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Connection failed');
            }

            // Store connection data
            this.connectionData = {
                host: formData.get('host'),
                username: formData.get('username'),
                password: formData.get('password'),
                type: serverType,
                port: port,
                path: path
            };
            
            this.isConnected = true;
            return result.data;

        } catch (error) {
            this.isConnected = false;
            this.connectionData = null;
            console.error('FTP Connection Error:', error);
            throw error;
        }
    }

    async upload(content) {
        if (!this.isConnected || !this.connectionData) {
            throw new Error('Not connected to FTP server');
        }

        try {
            const formData = new FormData();
            Object.entries(this.connectionData).forEach(([key, value]) => {
                formData.append(key, value);
            });
            formData.append('action', 'update');
            formData.append('content', content);

            const response = await fetch('ftp-handler.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Upload failed');
            }

            return result.data;
        } catch (error) {
            throw error;
        }
    }
}