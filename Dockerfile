# Multi-stage Dockerfile pour PolyStat Dashboard
# Arguments pour les proxies
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Stage 1: Build Frontend (Node.js)
FROM node:18-alpine AS frontend-builder

# Configuration des proxies pour npm
ENV HTTP_PROXY=$HTTP_PROXY
ENV HTTPS_PROXY=$HTTPS_PROXY
ENV NO_PROXY=$NO_PROXY

WORKDIR /app/frontend

# Copier package.json et package-lock.json
COPY polystat-frontend/package*.json ./

# Installer les dépendances
RUN rm -f package-lock.json && npm install --production

# Copier le code source du frontend
COPY polystat-frontend/ ./

# Nettoyer et réinstaller les dépendances pour résoudre le problème Rollup
RUN rm -rf node_modules package-lock.json && npm install

# Builder l'application frontend
RUN npm run build

# Stage 2: Build Backend (Python)
FROM python:3.11-alpine AS backend-builder

# Configuration des proxies pour pip
ENV HTTP_PROXY=$HTTP_PROXY
ENV HTTPS_PROXY=$HTTPS_PROXY
ENV NO_PROXY=$NO_PROXY

WORKDIR /app/backend

# Installer les dépendances système nécessaires pour Python
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev

# Copier requirements.txt
COPY polystat-backend/requirements.txt ./

# Créer un environnement virtuel et installer les dépendances
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source du backend
COPY polystat-backend/app ./app

# Stage 3: Image finale Alpine
FROM python:3.11-alpine AS production

# Installer les dépendances runtime
RUN apk add --no-cache \
    libffi \
    openssl

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S polystat && \
    adduser -S polystat -u 1001 -G polystat

WORKDIR /app

# Copier l'environnement virtuel Python du stage builder
COPY --from=backend-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copier le code du backend
COPY --from=backend-builder /app/backend/app ./app

# Copier les assets du frontend buildé
COPY --from=frontend-builder /app/frontend/dist ./static

# Copier les fichiers publics (favicons, etc.)
COPY --from=frontend-builder /app/frontend/public ./static/public

# Créer les répertoires nécessaires
RUN mkdir -p /app/data && \
    chown -R polystat:polystat /app

# Passer à l'utilisateur non-root
USER polystat

# Exposer le port
EXPOSE 8000

# Variables d'environnement
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    STATIC_FILES_DIR=/app/static

# Commande de démarrage
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]