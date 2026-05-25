# BookSync Docker Deployment

Create a local `.env` file next to `docker-compose.yml`. This file is not committed.

```env
BOOKSYNC_PORT=3015
BOOKSYNC_CONFIG_PATH=./config
BOOKSYNC_DOWNLOADS_PATH=/absolute/path/to/audiobooks
TZ=America/Chicago
```

Inside the BookSync web app, keep the NAS export path set to:

```text
/downloads
```

Docker maps `/downloads` to `BOOKSYNC_DOWNLOADS_PATH` on the host. If this value is wrong, BookSync will write to the wrong library.

Verify the active mount:

```bash
docker inspect booksync --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

Rebuild:

```bash
docker compose down
docker compose up --build -d
```
