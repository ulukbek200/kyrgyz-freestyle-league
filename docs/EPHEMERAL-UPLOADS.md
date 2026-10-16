# Temporary uploads for a test deployment

Production continues to require an absolute UPLOAD_DIR backed by persistent storage. The application validates the path; the operator must ensure the persistent disk is actually mounted. The default Render configuration remains unchanged.

For a disposable Render test service without a disk, explicitly set both environment variables:

```text
ALLOW_EPHEMERAL_UPLOADS=true
UPLOAD_DIR=/tmp/kfl-uploads
```

Only the exact flag value `true` enables the exception. An empty, relative or different directory is rejected in this mode. Using this temporary directory in production without the flag is also rejected. At startup the API warns that photos may be permanently lost after restart, redeploy or instance replacement. Database records do not restore lost files; do not register real athletes in this disposable environment.

For a permanent launch, attach persistent storage, set UPLOAD_DIR to its absolute uploads directory and remove the flag or set it to false. Copy any required test files separately before switching. No database migration is required.

This change does not configure Render remotely, deploy the service or alter authentication, roles, registration, rankings or tournament logic.
