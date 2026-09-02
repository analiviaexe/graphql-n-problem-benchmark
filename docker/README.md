# Infraestrutura Docker - Banco de Dados PostgreSQL 16

Este repositório utiliza Docker Compose para fornecer um ambiente de banco de dados PostgreSQL 16 isolado, simétrico e com recursos de hardware rigorosamente limitados para os experimentos do TCC.

---

## 📄 Estrutura do `docker-compose.yml`

```yaml
version: '3.8'

networks:
  graphql-bench-net:
    driver: bridge

services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres-bench
    restart: always
    environment:
      POSTGRES_DB: imdb_bench
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    ports:
      - "5432:5432"
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2048M
        reservations:
          cpus: '1.0'
          memory: 512M
    networks:
      - graphql-bench-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d imdb_bench"]
      interval: 5s
      timeout: 5s
      retries: 5
```

---

## 🔬 Detalhamento Conceitual das Configurações

### 1. Versão e Rede Privada (`version` e `networks`)
- **`version: '3.8'`**: Especifica a sintaxe do Docker Compose compatível com restrições explícitas de recursos (`deploy.resources`).
- **`graphql-bench-net` (Driver `bridge`)**: Cria uma ponte de rede virtual isolada dentro do kernel do Linux. Todos os contêineres do benchmark conectam-se a essa rede e comunicam-se entre si via DNS interno do Docker (ex: `postgres:5432`), evitando tráfego em rede externa e latências físicas.

### 2. Imagem e Configuração do Serviço (`services.postgres`)
- **`image: postgres:16-alpine`**: Utiliza a imagem oficial do PostgreSQL 16 baseada no Alpine Linux. O Alpine possui um footprint minimalista (~35MB), garantindo que quase zero de memória RAM seja desperdiçado com processos auxiliares de sistema operacional.
- **`container_name: postgres-bench`**: Nome estático do contêiner para monitoramento simples via `docker stats` e `docker inspect`.
- **`restart: always`**: Garante reinicialização automática do contêiner em caso de falha.

### 3. Credenciais e Porta (`environment` e `ports`)
- **`POSTGRES_DB: imdb_bench`**: Banco de dados relacional criado automaticamente na inicialização.
- **`POSTGRES_USER` / `POSTGRES_PASSWORD`**: Credenciais de acesso SQL (`postgres` / `postgrespassword`).
- **`ports: "5432:5432"`**: Exposição da porta 5432 para acesso via `localhost` a partir de ferramentas locais de desenvolvimento (ex: DBeaver, psql).

### 4. Limites de Hardware (`deploy.resources` / Linux `cgroups`)
Garante simetria metodológica e determinismo nos experimentos:
- **`limits` (Hard Limit):**
  - `cpus: '2.0'`: O PostgreSQL é limitado pelo kernel Linux a utilizar no máximo 200% de capacidade de CPU (equivalente a 2 núcleos inteiros).
  - `memory: 2048M`: Teto máximo estrito de 2 Gigabytes de RAM.
- **`reservations` (Soft Limit):**
  - `cpus: '1.0'` e `memory: 512M`: Garantia mínima reservada de recursos dedicados exclusivamente ao banco de dados.

### 5. Verificação de Saúde (`healthcheck`)
- Executa a cada 5 segundos o utilitário nativo `pg_isready -U postgres -d imdb_bench`.
- Garante que os scripts de ingestão de dados e servidores GraphQL só iniciem conexões quando o PostgreSQL estiver totalmente inicializado e pronto para processar requisições na porta 5432.
