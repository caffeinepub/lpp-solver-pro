import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Variable {
    coefficient: number;
    name: string;
}
export interface Constraint {
    value: number;
    operator: string;
    variables: Array<Variable>;
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
export interface LPProblem {
    id: bigint;
    constraints: Array<Constraint>;
    owner: Principal;
    objective: Array<Variable>;
    name: string;
    createdAt: bigint;
    isMaximize: boolean;
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
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getProblem(problemId: bigint): Promise<LPProblem | null>;
    getSolution(problemId: bigint): Promise<LPPSolution | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listAllProblems(): Promise<Array<LPProblem>>;
    listMyProblems(): Promise<Array<LPProblem>>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    solveProblem(problemId: bigint): Promise<LPPSolution | null>;
}
