# Serves the client on its own, with no tracker behind it.
#
# In this mode the page has no API to talk to, so it falls back to the bundled game data and
# you drop a .plr onto it. Useful for hosting the tracker somewhere shared.
#
# To run it against a tracker instead, build the server image — it bundles this client and
# serves both from one port.

FROM node:24-alpine AS build
WORKDIR /client

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The static fallback data has to be present or the drag-and-drop mode has no item list.
RUN test -f static/data/items.json || \
    (echo "error: run 'npm run sync-data' before building this image" && exit 1)
RUN npm run build


FROM nginx:1.29-alpine AS runtime
COPY --from=build /client/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
