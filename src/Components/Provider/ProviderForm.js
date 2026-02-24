import React, { useState } from "react";
import { InputText, FormLabel, Button } from "@trops/dash-react";

/**
 * ProviderForm component
 *
 * Application-level component for creating/editing providers.
 * Collects both the provider name and dynamically renders credential fields based on schema.
 * Used for both creating new providers and editing existing ones.
 *
 * @param {Object} credentialSchema - The schema defining credential fields
 *   Example:
 *   {
 *     appId: {
 *       type: "text",
 *       displayName: "Application ID",
 *       instructions: "Your Algolia Application ID",
 *       required: true,
 *       secret: true
 *     },
 *     apiKey: { ... }
 *   }
 * @param {Object} initialValues - Initial form values (for edit mode)
 * @param {Function} onSubmit - Callback when form is submitted: ({ name, credentials }) => void
 * @param {Function} onCancel - Callback when form is cancelled
 * @param {string} submitLabel - Label for submit button (default: "Create Provider")
 * @param {string} providerType - The provider type (e.g., "algolia", "slack") for display
 * @param {Function} onTestConnection - Optional callback to test connection: (credentials) => void
 * @param {boolean} isTesting - Whether a test connection is in progress
 */
export const ProviderForm = ({
    credentialSchema,
    initialValues = {},
    onSubmit,
    onCancel,
    submitLabel = "Create Provider",
    providerType = "",
    onTestConnection = null,
    isTesting = false,
}) => {
    const [providerName, setProviderName] = useState(initialValues.name || "");
    const [formData, setFormData] = useState(initialValues);
    const [errors, setErrors] = useState({});

    /**
     * Validate form based on schema requirements
     */
    const validateForm = () => {
        const newErrors = {};

        // Validate provider name
        if (!providerName?.trim()) {
            newErrors.providerName = "Provider name is required";
        }

        // Validate credential fields
        Object.entries(credentialSchema).forEach(([fieldName, fieldConfig]) => {
            if (fieldConfig.required && !formData[fieldName]?.trim()) {
                newErrors[fieldName] = `${fieldConfig.displayName} is required`;
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    /**
     * Handle input change
     */
    const handleInputChange = (fieldName, value) => {
        setFormData((prev) => ({
            ...prev,
            [fieldName]: value,
        }));

        // Clear error for this field if it was filled
        if (errors[fieldName] && value?.trim()) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    };

    /**
     * Handle form submission
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        if (validateForm()) {
            // Call onSubmit with both provider name and credentials
            onSubmit({
                name: providerName.trim(),
                credentials: formData,
            });
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 h-full">
            {/* Provider Name Field */}
            <div className="flex flex-col gap-2">
                <FormLabel label="Provider Name" required={true} />

                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Give this provider a descriptive name (e.g., "Algolia
                    Production", "Slack Dev")
                </p>

                <InputText
                    type="text"
                    value={providerName}
                    onChange={(value) => {
                        setProviderName(value);
                        // Clear error if filled
                        if (errors.providerName && value?.trim()) {
                            setErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors.providerName;
                                return newErrors;
                            });
                        }
                    }}
                    placeholder="Enter provider name"
                    className={errors.providerName ? "border-red-500" : ""}
                />

                {errors.providerName && (
                    <p className="text-sm text-red-500 dark:text-red-400">
                        {errors.providerName}
                    </p>
                )}
            </div>
            {/* Divider */}
            <div className="border-t border-gray-300 dark:border-gray-700 my-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-4">
                    CREDENTIALS
                </p>
            </div>

            {/* Credential Fields from Schema */}
            {Object.entries(credentialSchema).map(
                ([fieldName, fieldConfig]) => (
                    <div key={fieldName} className="flex flex-col gap-2">
                        <FormLabel
                            label={fieldConfig.displayName}
                            required={fieldConfig.required}
                        />

                        {fieldConfig.instructions && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {fieldConfig.instructions}
                            </p>
                        )}

                        {fieldConfig.type === "text" && (
                            <InputText
                                type={fieldConfig.secret ? "password" : "text"}
                                value={formData[fieldName] || ""}
                                onChange={(value) =>
                                    handleInputChange(fieldName, value)
                                }
                                placeholder={`Enter ${fieldConfig.displayName.toLowerCase()}`}
                                className={
                                    errors[fieldName] ? "border-red-500" : ""
                                }
                            />
                        )}

                        {errors[fieldName] && (
                            <p className="text-sm text-red-500 dark:text-red-400">
                                {errors[fieldName]}
                            </p>
                        )}
                    </div>
                )
            )}
            {/* Form Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-300 dark:border-gray-700">
                <Button
                    title="Cancel"
                    onClick={onCancel}
                    backgroundColor="bg-gray-100"
                    textColor="text-gray-700"
                    hoverBackgroundColor="hover:bg-gray-200"
                    padding="px-4 py-2"
                    textSize="text-sm"
                />
                {onTestConnection && (
                    <Button
                        title={isTesting ? "Testing..." : "Test Connection"}
                        onClick={() => onTestConnection(formData)}
                        backgroundColor="bg-gray-600"
                        textColor="text-white"
                        hoverBackgroundColor="hover:bg-gray-500"
                        padding="px-4 py-2"
                        textSize="text-sm"
                    />
                )}
                <Button
                    title={submitLabel}
                    onClick={handleSubmit}
                    backgroundColor="bg-blue-600"
                    textColor="text-white"
                    hoverBackgroundColor="hover:bg-blue-700"
                    padding="px-4 py-2"
                    textSize="text-sm"
                />
            </div>
        </div>
    );
};
