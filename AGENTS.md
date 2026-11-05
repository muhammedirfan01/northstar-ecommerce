# Northstar verification

Code tests are mandatory for future changes. Complete frontend changes before backend changes when a task spans both.

Before delivery, run the frontend build and lint checks, regression browser tests for changed interactions, and backend tests for affected behavior. Add meaningful regression cases for bug fixes, including sorting before pagination when ordering a catalog. Report failing checks accurately and distinguish pre-existing failures from regressions. Never claim a live database or external integration was tested when only fixtures were used.
