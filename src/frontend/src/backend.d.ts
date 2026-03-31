import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface FeedbackStats {
    totalCount: bigint;
    averageRating: number;
}
export interface FeedbackEntry {
    id: bigint;
    principal: Principal;
    name?: string;
    email?: string;
    comment: string;
    timestamp: bigint;
    problemContext: string;
    rating: bigint;
}
export interface Constraint {
    value: number;
    operator: string;
    variables: Array<Variable>;
}
export interface LPProblem {
    id: bigint;
    constraints: Array<Constraint>;
    owner: Principal;
    objective: Array<Variable>;
    name: string;
    createdAt: bigint;
    isMaximize: boolean;
}
export interface Variable {
    coefficient: number;
    name: string;
}
export interface LPPSolution {
    status: string;
    problemId: bigint;
    variables: Array<[string, number]>;
    objectiveValue?: number;
}
export interface UserProfile {
    name: string;
    email: string;
}
export interface UserActivity {
    firstSeen: bigint;
    principal: Principal;
    visitCount: bigint;
    solveCount: bigint;
    lastLogin: bigint;
    dualSimplexCount: bigint;
    location: string;
    simplexCount: bigint;
    cuttingPlaneCount: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createProblem(name: string, objective: Array<Variable>, isMaximize: boolean, constraints: Array<Constraint>): Promise<bigint>;
    deleteProblem(problemId: bigint): Promise<boolean>;
    getAllFeedback(): Promise<Array<FeedbackEntry>>;
    getAllUserActivity(): Promise<Array<UserActivity>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getFeedbackStats(): Promise<FeedbackStats>;
    getProblem(problemId: bigint): Promise<LPProblem | null>;
    getSolution(problemId: bigint): Promise<LPPSolution | null>;
    getUserActivity(user: Principal): Promise<UserActivity | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listAllProblems(): Promise<Array<LPProblem>>;
    listMyProblems(): Promise<Array<LPProblem>>;
    recordLogin(location: string): Promise<void>;
    recordSolve(method: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    solveProblem(problemId: bigint): Promise<LPPSolution | null>;
    submitFeedback(name: string | null, email: string | null, rating: bigint, comment: string, problemContext: string): Promise<bigint>;
}
