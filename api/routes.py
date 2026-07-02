from controllers.health import health_blueprint
from controllers.apps import apps_blueprint
from controllers.crashes import crashes_blueprint
from controllers.sessions import sessions_blueprint
from controllers.issues import issues_blueprint
from controllers.stats import stats_blueprint
from controllers.portal import portal_blueprint


def init_routes(app):
    app.register_blueprint(health_blueprint)
    app.register_blueprint(apps_blueprint)
    app.register_blueprint(crashes_blueprint)
    app.register_blueprint(sessions_blueprint)
    app.register_blueprint(issues_blueprint)
    app.register_blueprint(stats_blueprint)
    app.register_blueprint(portal_blueprint)
