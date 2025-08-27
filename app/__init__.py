# /mercado_livre_scraper/app/__init__.py

import sys
from flask import Flask

# Configura a codificação de E/S para UTF-8
if sys.version_info.major == 3:
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

def create_app():
    """Cria e configura a instância da aplicação Flask."""
    app = Flask(__name__)

    # Registra as rotas (Blueprints)
    from . import routes
    app.register_blueprint(routes.main_bp)

    return app