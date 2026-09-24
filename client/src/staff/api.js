// Staff-portal pages import this as `../api`. It re-exports the app's single
// shared axios instance (same baseURL, credentials, and refresh-token
// interceptor as the rest of the app) so there's one auth/session story.
export { default } from '../api/axios';
