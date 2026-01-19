import React from 'react';
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

const ApiDocs: React.FC = () => {
    return (
        <div style={{ padding: '0' }}>
            <h1 style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>API Specification</h1>
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border-color)' }}>
                <SwaggerUI url="/openapi.yaml" />
            </div>
        </div>
    );
};

export default ApiDocs;
