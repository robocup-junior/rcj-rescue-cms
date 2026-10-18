FROM node:24-alpine

# Runtime packages
#   ffmpeg: video handling in documents
#   git: used by bower to fetch front-end components
#   font-noto-cjk, font-noto: fonts for PDFs (helper/pdfFont.js)
#     font-noto-cjk: Japanese, Chinese, Korean, Latin-1, Greek, Cyrillic
#     font-noto: the rest of Latin (Polish, Czech, Turkish, Vietnamese, ...), accented Greek
RUN apk add --no-cache \
    ffmpeg \
    git \
    zip \
    unzip \
    font-noto-cjk \
    font-noto

WORKDIR /opt/rcj-cms

# Dependencies first, so this layer is reused until the package files change
COPY package.json package-lock.json bower.json .bowerrc ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && npx --yes bower@1.8.14 install --allow-root \
 && npm cache clean --force \
 && apk del .build-deps

COPY . .
RUN mkdir -p logs documents

CMD ["npm", "run", "start"]
EXPOSE 3000
