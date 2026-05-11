import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface ChatIn {
    conversation_id?: string | null;
    lang?: string;
    message: string;
}
export interface ChatOut {
    citations?: Citation[];
    conversation_id: string;
    response: string;
    trace_id?: string | null;
}
export interface Citation {
    page?: number | null;
    title: string;
    url: string;
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface ConversationListOut {
    conversations: ConversationOut[];
}
export interface ConversationOut {
    id: string;
    title?: string | null;
    updated_at?: string | null;
}
export interface DocumentOut {
    content: string;
    content_type?: string;
    highlight_text?: string | null;
    page?: number | null;
    title: string;
}
export interface FeedbackIn {
    comment?: string;
    is_positive: boolean;
    trace_id: string;
}
export interface FeedbackOut {
    success: boolean;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface MessageOut {
    citations?: Citation[] | null;
    content: string;
    role: string;
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface ChatParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const chat = async (data: ChatIn, params?: ChatParams, options?: RequestInit): Promise<{
    data: ChatOut;
}> =>{
    const res = await fetch("/api/chat", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useChat(options?: {
    mutation?: UseMutationOptions<{
        data: ChatOut;
    }, ApiError, {
        params: ChatParams;
        data: ChatIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>chat(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface ListConversationsParams {
    limit?: number;
}
export const listConversations = async (params?: ListConversationsParams, options?: RequestInit): Promise<{
    data: ConversationListOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params?.limit));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/conversations?${queryString}` : "/api/conversations";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listConversationsKey = (params?: ListConversationsParams)=>{
    return [
        "/api/conversations",
        params
    ] as const;
};
export function useListConversations<TData = {
    data: ConversationListOut;
}>(options?: {
    params?: ListConversationsParams;
    query?: Omit<UseQueryOptions<{
        data: ConversationListOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listConversationsKey(options?.params),
        queryFn: ()=>listConversations(options?.params),
        ...options?.query
    });
}
export function useListConversationsSuspense<TData = {
    data: ConversationListOut;
}>(options?: {
    params?: ListConversationsParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: ConversationListOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listConversationsKey(options?.params),
        queryFn: ()=>listConversations(options?.params),
        ...options?.query
    });
}
export interface DeleteConversationParams {
    conversation_id: string;
}
export const deleteConversation = async (params: DeleteConversationParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch(`/api/conversations/${params.conversation_id}`, {
        ...options,
        method: "DELETE"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useDeleteConversation(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: DeleteConversationParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>deleteConversation(vars.params),
        ...options?.mutation
    });
}
export interface GetMessagesParams {
    conversation_id: string;
    limit?: number;
}
export const getMessages = async (params: GetMessagesParams, options?: RequestInit): Promise<{
    data: MessageOut[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params?.limit));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/conversations/${params.conversation_id}/messages?${queryString}` : `/api/conversations/${params.conversation_id}/messages`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getMessagesKey = (params?: GetMessagesParams)=>{
    return [
        "/api/conversations/{conversation_id}/messages",
        params
    ] as const;
};
export function useGetMessages<TData = {
    data: MessageOut[];
}>(options: {
    params: GetMessagesParams;
    query?: Omit<UseQueryOptions<{
        data: MessageOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getMessagesKey(options.params),
        queryFn: ()=>getMessages(options.params),
        ...options?.query
    });
}
export function useGetMessagesSuspense<TData = {
    data: MessageOut[];
}>(options: {
    params: GetMessagesParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: MessageOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getMessagesKey(options.params),
        queryFn: ()=>getMessages(options.params),
        ...options?.query
    });
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export interface GetDocumentParams {
    url: string;
}
export const getDocument = async (params: GetDocumentParams, options?: RequestInit): Promise<{
    data: DocumentOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params.url != null) searchParams.set("url", String(params.url));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/document?${queryString}` : "/api/document";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getDocumentKey = (params?: GetDocumentParams)=>{
    return [
        "/api/document",
        params
    ] as const;
};
export function useGetDocument<TData = {
    data: DocumentOut;
}>(options: {
    params: GetDocumentParams;
    query?: Omit<UseQueryOptions<{
        data: DocumentOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getDocumentKey(options.params),
        queryFn: ()=>getDocument(options.params),
        ...options?.query
    });
}
export function useGetDocumentSuspense<TData = {
    data: DocumentOut;
}>(options: {
    params: GetDocumentParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: DocumentOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getDocumentKey(options.params),
        queryFn: ()=>getDocument(options.params),
        ...options?.query
    });
}
export interface SubmitFeedbackParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const submitFeedback = async (data: FeedbackIn, params?: SubmitFeedbackParams, options?: RequestInit): Promise<{
    data: FeedbackOut;
}> =>{
    const res = await fetch("/api/feedback", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSubmitFeedback(options?: {
    mutation?: UseMutationOptions<{
        data: FeedbackOut;
    }, ApiError, {
        params: SubmitFeedbackParams;
        data: FeedbackIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>submitFeedback(vars.data, vars.params),
        ...options?.mutation
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
