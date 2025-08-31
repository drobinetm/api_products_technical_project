declare namespace NodeJS {
  export interface ProcessEnv {
    // Server
    PORT?: string;
    NODE_ENV: 'development' | 'production' | 'test';
    
    // MongoDB
    MONGO_URI: string;
    
    // RabbitMQ
    RABBITMQ_URL: string;
    RABBITMQ_EXCHANGE: string;
    RABBITMQ_QUEUE: string;
    
    // Elasticsearch
    ELASTICSEARCH_NODE: string;
    ELASTICSEARCH_INDEX: string;
  }
}

export {};
