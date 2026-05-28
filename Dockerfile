FROM ryorobo/rcj-scoring-node:latest

COPY . /opt/rcj-cms/
WORKDIR /opt/rcj-cms

# install deps + build assets
RUN npm install -g bower \
 && bower install --allow-root \
 && npm ci --omit=dev \
 && mkdir -p logs documents

CMD ["npm", "run", "start"]
EXPOSE 3000