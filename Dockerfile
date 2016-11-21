
FROM node:argon

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

#RUN npm install pm2 -g

COPY package.json /usr/src/app/
#RUN npm install

COPY . /usr/src/app

#RUN npm run build

#EXPOSE 8080
#CMD [ "pm2", "start", "bin/server.js"]
