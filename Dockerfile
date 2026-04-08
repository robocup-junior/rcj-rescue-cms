FROM ryorobo/rcj-scoring-node:latest

COPY . /opt/rcj-cms/
WORKDIR /opt/rcj-cms

# install deps + build assets
RUN npm install -g workbox-cli
RUN npm install -g bower
RUN bower install --allow-root
RUN npm run build
RUN mkdir -p logs documents
RUN apk add --no-cache \
     autoconf automake libtool \
     build-base python3 \
     nasm \
     zlib-dev libpng-dev \
&& npm ci --omit=optional --ignore-scripts \
&& npm install -g bower \
&& bower install --allow-root \
&& npm run build \
&& mkdir -p logs documents

CMD ["npm", "run", "start"]
EXPOSE 3000