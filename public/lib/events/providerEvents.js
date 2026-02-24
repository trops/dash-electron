/**
 * Event Constants File - Provider Events
 *
 * This file contains event constants for provider-related IPC communication.
 */
const PROVIDER_SAVE = "provider-save";
const PROVIDER_SAVE_COMPLETE = "provider-save-complete";
const PROVIDER_SAVE_ERROR = "provider-save-error";

const PROVIDER_LIST = "provider-list";
const PROVIDER_LIST_COMPLETE = "provider-list-complete";
const PROVIDER_LIST_ERROR = "provider-list-error";

const PROVIDER_GET = "provider-get";
const PROVIDER_GET_COMPLETE = "provider-get-complete";
const PROVIDER_GET_ERROR = "provider-get-error";

const PROVIDER_DELETE = "provider-delete";
const PROVIDER_DELETE_COMPLETE = "provider-delete-complete";
const PROVIDER_DELETE_ERROR = "provider-delete-error";

module.exports = {
    PROVIDER_SAVE,
    PROVIDER_SAVE_COMPLETE,
    PROVIDER_SAVE_ERROR,
    PROVIDER_LIST,
    PROVIDER_LIST_COMPLETE,
    PROVIDER_LIST_ERROR,
    PROVIDER_GET,
    PROVIDER_GET_COMPLETE,
    PROVIDER_GET_ERROR,
    PROVIDER_DELETE,
    PROVIDER_DELETE_COMPLETE,
    PROVIDER_DELETE_ERROR,
};
