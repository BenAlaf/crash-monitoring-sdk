# imports:
from flask import Flask
from flasgger import Swagger
from mongodb_connection_holder import MongoConnectionHolder
from routes import init_routes
from services.db_indexes import ensure_indexes
import os

# set app and swagger:
app = Flask(__name__)
swagger = Swagger(app, template={
    "info": {
        "title": "CrashMonitor API",
        "description": "Crash & error monitoring backend — ingests crash reports from the "
                       "CrashMonitor Android SDK, groups them into issues by fingerprint, "
                       "and serves stats to the admin portal.",
        "version": "0.1.0",
    }
})

# init DB connection and ensure indexes:
MongoConnectionHolder.init()
ensure_indexes(MongoConnectionHolder.get_db())

# set routes:
init_routes(app)

# run all:
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8082))
    app.run(port=port, host="0.0.0.0", debug=True)
