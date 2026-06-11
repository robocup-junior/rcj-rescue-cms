FROM ryorobo/rcj-scoring-node:25

COPY . /opt/rcj-cms/
WORKDIR /opt/rcj-cms

CMD ["npm", "run", "start"]
EXPOSE 3000
