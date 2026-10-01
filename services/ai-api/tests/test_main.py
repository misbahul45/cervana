import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os


def test_app_creates_without_celery_subprocess():
    with patch.dict(os.environ, {
        'OPENAI_API_KEY': 'test-key',
        'QDRANT_URL': 'http://localhost:6333',
        'QDRANT_COLLECTION': 'test',
        'QDRANT_MEMORY_COLLECTION': 'test-memory',
        'NEST_API': 'http://localhost:3002/api/v1',
        'ADMIN_URL': 'http://localhost:3001',
        'WEB_URL': 'http://localhost:3000',
        'REDIS_URL': 'redis://localhost:6379/0',
        'CELERY_BROKER_URL': 'redis://localhost:6379/0',
        'CELERY_RESULT_BACKEND': 'redis://localhost:6379/0',
        'PORT': '3003',
    }):
        with patch('subprocess.Popen') as mock_popen:
            mock_proc = MagicMock()
            mock_popen.return_value = mock_proc

            import importlib
            import main
            importlib.reload(main)

            assert hasattr(main, 'app')
            assert main.app.title == 'ReduCera AI Service'
            mock_popen.assert_not_called()


def test_root_endpoint():
    with patch.dict(os.environ, {
        'OPENAI_API_KEY': 'test-key',
        'QDRANT_URL': 'http://localhost:6333',
        'QDRANT_COLLECTION': 'test',
        'QDRANT_MEMORY_COLLECTION': 'test-memory',
        'NEST_API': 'http://localhost:3002/api/v1',
        'ADMIN_URL': 'http://localhost:3001',
        'WEB_URL': 'http://localhost:3000',
        'REDIS_URL': 'redis://localhost:6379/0',
        'CELERY_BROKER_URL': 'redis://localhost:6379/0',
        'CELERY_RESULT_BACKEND': 'redis://localhost:6379/0',
        'PORT': '3003',
    }):
        with patch('subprocess.Popen'):
            import importlib
            import main
            importlib.reload(main)

            client = TestClient(main.app)
            response = client.get('/')
            assert response.status_code == 200
            data = response.json()
            assert data['title'] == 'ReduCera AI Service'
            assert data['status'] == 'running'


def test_404_handler():
    with patch.dict(os.environ, {
        'OPENAI_API_KEY': 'test-key',
        'QDRANT_URL': 'http://localhost:6333',
        'QDRANT_COLLECTION': 'test',
        'QDRANT_MEMORY_COLLECTION': 'test-memory',
        'NEST_API': 'http://localhost:3002/api/v1',
        'ADMIN_URL': 'http://localhost:3001',
        'WEB_URL': 'http://localhost:3000',
        'REDIS_URL': 'redis://localhost:6379/0',
        'CELERY_BROKER_URL': 'redis://localhost:6379/0',
        'CELERY_RESULT_BACKEND': 'redis://localhost:6379/0',
        'PORT': '3003',
    }):
        with patch('subprocess.Popen'):
            import importlib
            import main
            importlib.reload(main)

            client = TestClient(main.app)
            response = client.get('/nonexistent')
            assert response.status_code == 404
            data = response.json()
            assert data['message'] == 'Not Found'