# Backend services

Services perform integrations and image processing used by controllers.

- `googleAuthService.js`: exchanges Google authorization codes and verifies Google ID tokens.
- `emailService.js`: sends verification emails for registration, recovery, and account security.
- `catalogImageService.js`: validates, resizes, uploads, and removes catalog and review images, including cleanup after failed uploads.
- `profilePhotoService.js`: validates and processes profile photos.

Controllers validate workflow results, read and update models, and send HTTP responses. Services do not use Express request or response objects. Connection setup stays in `config/`; small calculation, formatting, validation, and token helpers stay in `utils/`.
