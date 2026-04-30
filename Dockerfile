FROM ryorobo/rcj-scoring-node:latest

COPY . /opt/rcj-cms/
WORKDIR /opt/rcj-cms

# install deps + build assets
RUN apk add --no-cache python3 \
 && npm install -g workbox-cli bower \
 && bower install --allow-root \
 && npm ci --omit=optional --ignore-scripts \
 && npm run build \
 && mkdir -p logs documents

CMD ["npm", "run", "start"]
EXPOSE 3000