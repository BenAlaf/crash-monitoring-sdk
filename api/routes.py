from controllers.health import health_blueprint


def init_routes(app):
    app.register_blueprint(health_blueprint)
