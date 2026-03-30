import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";
import Float "mo:core/Float";
import Text "mo:core/Text";
import Time "mo:core/Time";

actor {
  // Authentication system state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile Management
  public type UserProfile = {
    name : Text;
    email : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  // Get current user's profile
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  // Get another user's profile (admin only or own profile)
  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile or must be admin");
    };
    userProfiles.get(user);
  };

  // Save current user's profile
  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // LPP Solver Pro Functionality
  public type Variable = {
    name : Text;
    coefficient : Float;
  };

  public type Constraint = {
    variables : [Variable];
    operator : Text; // "<=", ">=", "="
    value : Float;
  };

  public type LPProblem = {
    id : Nat;
    owner : Principal;
    name : Text;
    objective : [Variable]; // Objective function to maximize/minimize
    isMaximize : Bool;
    constraints : [Constraint];
    createdAt : Int;
  };

  public type LPPSolution = {
    problemId : Nat;
    status : Text; // "optimal", "infeasible", "unbounded"
    objectiveValue : ?Float;
    variables : [(Text, Float)];
  };

  var nextProblemId : Nat = 0;
  let problems = Map.empty<Nat, LPProblem>();
  let solutions = Map.empty<Nat, LPPSolution>();

  // Create a new LP problem (users only)
  public shared ({ caller }) func createProblem(
    name : Text,
    objective : [Variable],
    isMaximize : Bool,
    constraints : [Constraint],
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create problems");
    };

    let problemId = nextProblemId;
    nextProblemId += 1;

    let problem : LPProblem = {
      id = problemId;
      owner = caller;
      name = name;
      objective = objective;
      isMaximize = isMaximize;
      constraints = constraints;
      createdAt = Time.now();
    };

    problems.add(problemId, problem);
    problemId;
  };

  // Get a problem (owner or admin only)
  public query ({ caller }) func getProblem(problemId : Nat) : async ?LPProblem {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view problems");
    };

    switch (problems.get(problemId)) {
      case null { null };
      case (?problem) {
        if (problem.owner != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only view your own problems or must be admin");
        };
        ?problem;
      };
    };
  };

  // List all problems for current user
  public query ({ caller }) func listMyProblems() : async [LPProblem] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list problems");
    };

    let userProblems = problems.values().toArray().filter(
      func(p : LPProblem) : Bool { p.owner == caller }
    );
    userProblems;
  };

  // List all problems (admin only)
  public query ({ caller }) func listAllProblems() : async [LPProblem] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can list all problems");
    };
    problems.values().toArray();
  };

  // Solve a problem (owner or admin only)
  public shared ({ caller }) func solveProblem(problemId : Nat) : async ?LPPSolution {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can solve problems");
    };

    switch (problems.get(problemId)) {
      case null { null };
      case (?problem) {
        if (problem.owner != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only solve your own problems or must be admin");
        };

        // Simplified solver (placeholder - real implementation would use simplex algorithm)
        let solution : LPPSolution = {
          problemId = problemId;
          status = "optimal";
          objectiveValue = ?0.0;
          variables = [];
        };

        solutions.add(problemId, solution);
        ?solution;
      };
    };
  };

  // Get solution (owner or admin only)
  public query ({ caller }) func getSolution(problemId : Nat) : async ?LPPSolution {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view solutions");
    };

    switch (problems.get(problemId)) {
      case null { null };
      case (?problem) {
        if (problem.owner != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only view solutions for your own problems or must be admin");
        };
        solutions.get(problemId);
      };
    };
  };

  // Delete a problem (owner or admin only)
  public shared ({ caller }) func deleteProblem(problemId : Nat) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete problems");
    };

    switch (problems.get(problemId)) {
      case null { false };
      case (?problem) {
        if (problem.owner != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only delete your own problems or must be admin");
        };
        problems.remove(problemId);
        solutions.remove(problemId);
        true;
      };
    };
  };
};
