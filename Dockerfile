FROM ryorobo/rcj-scoring-node:latest

COPY . /opt/rcj-cms/
WORKDIR /opt/rcj-cms

# install deps + build assets
RUN npm ci \
 && npm install -g bower \
 && bower install --allow-root \
 && npm run build \
 && mkdir -p logs documents

CMD ["npm", "run", "start"]
EXPOSE 3000