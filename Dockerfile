FROM node:20-bullseye

# Install LibreOffice headless + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core libreoffice-impress libreoffice-writer \
    fonts-dejavu-core fontconfig \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
