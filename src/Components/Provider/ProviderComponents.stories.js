import React, { useState } from "react";
import { MissingProviderPrompt } from "./MissingProviderPrompt";
import { ProviderForm } from "./ProviderForm";
import { ProviderSelector } from "./ProviderSelector";

const meta = {
    title: "Provider/Components",
    component: MissingProviderPrompt,
};
export default meta;

// Mock data
const mockAlgoliaSchema = {
    appId: {
        type: "text",
        displayName: "Application ID",
        instructions: "Your Algolia Application ID",
        required: true,
        secret: true,
    },
    apiKey: {
        type: "text",
        displayName: "API Key",
        instructions: "Your Algolia API Key (should be read-only)",
        required: true,
        secret: true,
    },
    indexName: {
        type: "text",
        displayName: "Index Name",
        instructions: "Default Algolia index to search (e.g., 'products')",
        required: true,
        secret: false,
    },
};

const mockProviders = [
    {
        name: "algolia-prod",
        type: "algolia",
        credentials: {
            appId: "ABC123",
            apiKey: "***",
            indexName: "products",
        },
    },
    {
        name: "algolia-staging",
        type: "algolia",
        credentials: {
            appId: "DEF456",
            apiKey: "***",
            indexName: "staging-products",
        },
    },
];

/**
 * MissingProviderPrompt Story
 * Shows the state when a widget requires a provider that hasn't been configured
 */
export const MissingProvider = () => {
    const [message, setMessage] = useState("");

    return (
        <div style={{ height: "600px", backgroundColor: "#f5f5f5" }}>
            <MissingProviderPrompt
                requiredProviders={[
                    {
                        type: "algolia",
                        credentialSchema: mockAlgoliaSchema,
                    },
                ]}
                registeredProviders={[]}
                onProviderSelect={(type, name, credentials) => {
                    setMessage(`Selected provider: ${name} (type: ${type})`);
                }}
            />
            {message && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 20,
                        right: 20,
                        backgroundColor: "#4CAF50",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "4px",
                    }}
                >
                    {message}
                </div>
            )}
        </div>
    );
};

/**
 * ProviderForm Story
 * Shows the form for creating/editing a provider
 */
export const FormCreate = () => {
    const [message, setMessage] = useState("");

    return (
        <div style={{ backgroundColor: "#f5f5f5", padding: "20px" }}>
            <div
                style={{
                    maxWidth: "500px",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
            >
                <ProviderForm
                    credentialSchema={mockAlgoliaSchema}
                    onSubmit={(credentials) => {
                        setMessage(
                            `Provider created with credentials: ${JSON.stringify(
                                credentials
                            )}`
                        );
                    }}
                    onCancel={() => {
                        setMessage("Form cancelled");
                    }}
                    submitLabel="Create Provider"
                />
            </div>
            {message && (
                <div
                    style={{
                        marginTop: "20px",
                        padding: "10px",
                        backgroundColor: "#e8f5e9",
                        border: "1px solid #4CAF50",
                        borderRadius: "4px",
                        color: "#2e7d32",
                    }}
                >
                    {message}
                </div>
            )}
        </div>
    );
};

/**
 * ProviderForm Edit Story
 * Shows the form with pre-filled values for editing
 */
export const FormEdit = () => {
    const [message, setMessage] = useState("");

    return (
        <div style={{ backgroundColor: "#f5f5f5", padding: "20px" }}>
            <div
                style={{
                    maxWidth: "500px",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
            >
                <ProviderForm
                    credentialSchema={mockAlgoliaSchema}
                    initialValues={{
                        appId: "ABC123",
                        apiKey: "secret-key",
                        indexName: "products",
                    }}
                    onSubmit={(credentials) => {
                        setMessage(
                            `Provider updated with credentials: ${JSON.stringify(
                                credentials
                            )}`
                        );
                    }}
                    onCancel={() => {
                        setMessage("Edit cancelled");
                    }}
                    submitLabel="Update Provider"
                />
            </div>
            {message && (
                <div
                    style={{
                        marginTop: "20px",
                        padding: "10px",
                        backgroundColor: "#e8f5e9",
                        border: "1px solid #4CAF50",
                        borderRadius: "4px",
                        color: "#2e7d32",
                    }}
                >
                    {message}
                </div>
            )}
        </div>
    );
};

/**
 * ProviderSelector Story - Select Existing
 * Shows the modal for selecting an existing provider
 */
export const SelectorSelectExisting = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [message, setMessage] = useState("");

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    padding: "10px 20px",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                }}
            >
                Open Provider Selector
            </button>

            <ProviderSelector
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                providerType="algolia"
                existingProviders={mockProviders}
                credentialSchema={mockAlgoliaSchema}
                onSelect={(providerName) => {
                    setMessage(`Selected provider: ${providerName}`);
                }}
                onCreate={(providerName, credentials) => {
                    setMessage(`Created provider: ${providerName}`);
                }}
            />

            {message && (
                <div
                    style={{
                        marginTop: "20px",
                        padding: "10px",
                        backgroundColor: "#e3f2fd",
                        border: "1px solid #2196F3",
                        borderRadius: "4px",
                        color: "#1565c0",
                    }}
                >
                    {message}
                </div>
            )}
        </>
    );
};

/**
 * ProviderSelector Story - No Existing Providers
 * Shows the modal when no existing providers are available
 */
export const SelectorNoProviders = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [message, setMessage] = useState("");

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    padding: "10px 20px",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                }}
            >
                Open Provider Selector
            </button>

            <ProviderSelector
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                providerType="algolia"
                existingProviders={[]}
                credentialSchema={mockAlgoliaSchema}
                onSelect={(providerName) => {
                    setMessage(`Selected provider: ${providerName}`);
                }}
                onCreate={(providerName, credentials) => {
                    setMessage(`Created provider: ${providerName}`);
                }}
            />

            {message && (
                <div
                    style={{
                        marginTop: "20px",
                        padding: "10px",
                        backgroundColor: "#e3f2fd",
                        border: "1px solid #2196F3",
                        borderRadius: "4px",
                        color: "#1565c0",
                    }}
                >
                    {message}
                </div>
            )}
        </>
    );
};

/**
 * Combined Flow Story
 * Shows the typical user flow: Missing Provider -> Selector -> Form
 */
export const CompleteFlow = () => {
    const [step, setStep] = useState(1);
    const [selectedProvider, setSelectedProvider] = useState(null);

    return (
        <div
            style={{
                padding: "20px",
                backgroundColor: "#f5f5f5",
                minHeight: "100vh",
            }}
        >
            <div style={{ marginBottom: "20px" }}>
                <h2>Provider Setup Flow</h2>
                <p>
                    Step {step}/3: {step === 1 && "Missing Provider Prompt"}
                    {step === 2 && "Select/Create Provider Modal"}
                    {step === 3 && "Success"}
                </p>
            </div>

            {step === 1 && (
                <div style={{ height: "500px" }}>
                    <MissingProviderPrompt
                        requiredProviders={[
                            {
                                type: "algolia",
                                credentialSchema: mockAlgoliaSchema,
                            },
                        ]}
                        registeredProviders={mockProviders.slice(0, 1)}
                        onProviderSelect={() => {
                            setStep(2);
                        }}
                    />
                </div>
            )}

            {step === 2 && (
                <button
                    onClick={() => {
                        setSelectedProvider("algolia-new");
                        setStep(3);
                    }}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginTop: "20px",
                    }}
                >
                    (Selector would appear here - click to continue)
                </button>
            )}

            {step === 3 && (
                <div
                    style={{
                        padding: "20px",
                        backgroundColor: "#e8f5e9",
                        border: "2px solid #4CAF50",
                        borderRadius: "8px",
                        marginTop: "20px",
                    }}
                >
                    <h3 style={{ color: "#2e7d32", marginTop: 0 }}>
                        ✓ Setup Complete!
                    </h3>
                    <p style={{ color: "#1b5e20" }}>
                        Provider selected: <strong>{selectedProvider}</strong>
                    </p>
                    <p style={{ color: "#1b5e20" }}>
                        Your widget is now ready to use.
                    </p>
                    <button
                        onClick={() => setStep(1)}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                        }}
                    >
                        Start Over
                    </button>
                </div>
            )}
        </div>
    );
};
