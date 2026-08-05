# Microverse

> A universe of applications, services, and intelligent systems where different technologies collaborate to solve real-world problems.

## 🌌 About Microverse

Microverse is a polyglot software platform built as a playground for modern software engineering.

The goal is to explore how different technologies, architectures, and ideas can work together to create a connected ecosystem of applications and services.

Each component of Microverse has its own identity, technology stack, and purpose — demonstrating that great software is not limited to one language or framework.

## 🏗️ Architecture

Microverse is organized into several layers:

### Frontend

User-facing applications and shared interface components.

* TaskFusion — productivity and project dashboard
* Planner — project planning experience
* Shared UI components and design resources

### Platform Services

Shared capabilities used across the Microverse ecosystem.

| Service                                                              | Status    | Purpose                                              |
| ---------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| [order-service](platform-services/order-service/README.md)             | scaffold  | Customer creates an order, uploads media             |
| [asset-service](platform-services/asset-service/README.md)             | scaffold  | Owns uploaded media — storage, versions, permissions |
| [task-service](platform-services/task-service/README.md)               | partial   | PM assigns quests/tasks to analysts                  |
| [notification-service](platform-services/notification-service/README.md) | partial | Decides who needs to know what                       |
| [email-service](platform-services/email-service/README.md)             | working   | Sends email via MailHog                              |
| [search-service](platform-services/search-service/README.md)           | scaffold  | Search for human users (Elasticsearch)               |
| [tracking-service](platform-services/tracking-service/README.md)       | scaffold  | Middleware in front of ElixTempo                     |
| [billing-service](platform-services/billing-service/README.md)         | scaffold  | Middleware in front of RustLedger                    |

### Domain Services

Specialized applications built with different technologies.

| Service     | Technology    | Purpose                             |
| ----------- | ------------- | ----------------------------------- |
| Laralytics  | Laravel       | Analytics platform                  |
| DjaPorts    | Django        | Reporting engine                    |
| GoFeeler    | Go            | Sentiment analysis                  |
| NetCruncher | .NET          | Calculation engine                  |
| PyReel      | Python        | Video processing                    |
| SpringPix   | Java/Spring   | Image and GIS processing            |
| RubyKudos   | Ruby          | Recognition system                  |
| ElixTempo   | Elixir        | Concurrent work-session time tracking |
| RustLedger  | Rust          | Billing — turns tracked time into invoices |

### Intelligence

AI-powered capabilities that connect and enhance the Microverse ecosystem.

* AI agents
* Knowledge services
* Model integrations
* Intelligent automation

### Infrastructure

The foundations that allow Microverse to run.

* Keycloak authentication
* PostgreSQL/PostGIS
* MongoDB
* Redis
* RabbitMQ
* Kafka
* MailHog (dev email capture)
* Docker
* Kubernetes

## 🧭 Philosophy

Microverse explores:

* Polyglot development
* Microservice architecture
* Event-driven systems
* Cloud-native deployment
* Artificial intelligence integration
* Modern authentication and authorization
* Different approaches to solving engineering problems

## 🚀 Status

Microverse is an evolving project.

The goal is not only to build applications, but to explore architecture, technologies, and the connections between them.

## 📜 License

MIT License

The Microverse name, branding, and visual identity remain reserved.
