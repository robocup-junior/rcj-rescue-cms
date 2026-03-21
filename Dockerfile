FROM ryorobo/rcj-scoring-node:latest

COPY . /opt/rcj-cms/
WORKDIR /opt/rcj-cms

# install deps + build assets
RUN npm install -g workbox-cli
RUN npm install -g bower
RUN bower install --allow-root
RUN npm run build
RUN mkdir -p logs documents

CMD ["npm", "run", "start"]
EXPOSE 3000