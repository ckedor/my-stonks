"""Settings that must hold before the application is imported at all.

`app.config.settings` builds its singleton at import time and only re-reads
`.env.test` when ENVIRONMENT is already `testing`, so this has to run before any
test module pulls the application in. Doing it here rather than in a lower
conftest also keeps the environment the same for every layer: `development`
swaps the authentication dependency for a stub that returns a fixed user, which
changes the published OpenAPI, so a suite that switched environments halfway
through would make the contract snapshot depend on collection order.
"""

import os

os.environ['ENVIRONMENT'] = 'testing'
