import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";
import Float "mo:core/Float";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Int "mo:core/Int";

actor {
  // Authentication system state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Auto-register a caller as a user if they have no role yet
  func ensureRegistered(caller : Principal) {
    if (caller.isAnonymous()) { return };
    switch (accessControlState.userRoles.get(caller)) {
      case (?_) {}; // already registered
      case (null) {
        accessControlState.userRoles.add(caller, #user);
      };
    };
  };

  // Separate admin principals set — completely independent of MixinAuthorization
  let adminPrincipals = Map.empty<Principal, Bool>();

  // Check if a caller is in our custom admin set
  func isCustomAdmin(caller : Principal) : Bool {
    if (caller.isAnonymous()) { return false };
    switch (adminPrincipals.get(caller)) {
      case (?true) { true };
      case (_) { false };
    };
  };

  // Claim admin with hardcoded token — stores in custom admin set
  public shared ({ caller }) func claimAdminWithToken(token : Text) : async Bool {
    if (caller.isAnonymous()) { return false };
    let expected = "Apple$12";
    if (token != expected) { return false };
    // Add to custom admin set
    adminPrincipals.add(caller, true);
    // Also update the MixinAuthorization role for compatibility
    accessControlState.userRoles.add(caller, #admin);
    accessControlState.adminAssigned := true;
    true;
  };

  // User Profile Management
  public type UserProfile = {
    name : Text;
    email : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  // Get current user's profile
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    userProfiles.get(caller);
  };

  // Get another user's profile (admin only or own profile)
  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile or must be admin");
    };
    userProfiles.get(user);
  };

  // Get all user profiles (admin only)
  public query ({ caller }) func getAllUserProfiles() : async [(Principal, UserProfile)] {
    if (not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can view all profiles");
    };
    userProfiles.entries().toArray();
  };

  // Save current user's profile
  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    ensureRegistered(caller);
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
    objective : [Variable];
    isMaximize : Bool;
    constraints : [Constraint];
    createdAt : Int;
  };

  public type LPPSolution = {
    problemId : Nat;
    status : Text;
    objectiveValue : ?Float;
    variables : [(Text, Float)];
  };

  var nextProblemId : Nat = 0;
  let problems = Map.empty<Nat, LPProblem>();
  let solutions = Map.empty<Nat, LPPSolution>();

  public shared ({ caller }) func createProblem(
    name : Text,
    objective : [Variable],
    isMaximize : Bool,
    constraints : [Constraint],
  ) : async Nat {
    ensureRegistered(caller);
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

  public query ({ caller }) func getProblem(problemId : Nat) : async ?LPProblem {
    switch (problems.get(problemId)) {
      case null { null };
      case (?problem) {
        if (problem.owner != caller and not isCustomAdmin(caller)) {
          Runtime.trap("Unauthorized: Can only view your own problems or must be admin");
        };
        ?problem;
      };
    };
  };

  public query ({ caller }) func listMyProblems() : async [LPProblem] {
    problems.values().toArray().filter(
      func(p : LPProblem) : Bool { p.owner == caller }
    );
  };

  public query ({ caller }) func listAllProblems() : async [LPProblem] {
    if (not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can list all problems");
    };
    problems.values().toArray();
  };

  public shared ({ caller }) func solveProblem(problemId : Nat) : async ?LPPSolution {
    switch (problems.get(problemId)) {
      case null { null };
      case (?problem) {
        if (problem.owner != caller and not isCustomAdmin(caller)) {
          Runtime.trap("Unauthorized: Can only solve your own problems or must be admin");
        };
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

  public query ({ caller }) func getSolution(problemId : Nat) : async ?LPPSolution {
    switch (problems.get(problemId)) {
      case null { null };
      case (?problem) {
        if (problem.owner != caller and not isCustomAdmin(caller)) {
          Runtime.trap("Unauthorized: Can only view solutions for your own problems or must be admin");
        };
        solutions.get(problemId);
      };
    };
  };

  public shared ({ caller }) func deleteProblem(problemId : Nat) : async Bool {
    switch (problems.get(problemId)) {
      case null { false };
      case (?problem) {
        if (problem.owner != caller and not isCustomAdmin(caller)) {
          Runtime.trap("Unauthorized: Can only delete your own problems or must be admin");
        };
        problems.remove(problemId);
        solutions.remove(problemId);
        true;
      };
    };
  };

  // Feedback System
  public type FeedbackEntry = {
    id : Nat;
    principal : Principal;
    name : ?Text;
    email : ?Text;
    rating : Nat;
    comment : Text;
    timestamp : Int;
    problemContext : Text;
  };

  var nextFeedbackId : Nat = 0;
  let feedbackEntries = Map.empty<Nat, FeedbackEntry>();

  public shared ({ caller }) func submitFeedback(
    name : ?Text,
    email : ?Text,
    rating : Nat,
    comment : Text,
    problemContext : Text,
  ) : async Nat {
    ensureRegistered(caller);
    if (rating == 0 or rating > 5) {
      Runtime.trap("Rating must be between 1 and 5");
    };
    let feedbackId = nextFeedbackId;
    nextFeedbackId += 1;
    let entry : FeedbackEntry = {
      id = feedbackId;
      principal = caller;
      name;
      email;
      rating;
      comment;
      timestamp = Time.now();
      problemContext;
    };
    feedbackEntries.add(feedbackId, entry);
    feedbackId;
  };

  public query ({ caller }) func getAllFeedback() : async [FeedbackEntry] {
    if (not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can view all feedback");
    };
    feedbackEntries.values().toArray();
  };

  public type FeedbackStats = {
    totalCount : Nat;
    averageRating : Float;
  };

  public query ({ caller }) func getFeedbackStats() : async FeedbackStats {
    if (not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can view feedback stats");
    };
    let feedbackArray = feedbackEntries.values().toArray();
    let count = feedbackArray.size();
    if (count == 0) {
      return { totalCount = 0; averageRating = 0.0 };
    };
    let sum = feedbackArray.foldLeft(
      0,
      func(acc : Nat, entry : FeedbackEntry) : Nat { acc + entry.rating },
    );
    {
      totalCount = count;
      averageRating = sum.toFloat() / count.toInt().toFloat();
    };
  };

  // User Activity Tracking
  public type UserActivity = {
    principal : Principal;
    firstSeen : Int;
    lastLogin : Int;
    visitCount : Nat;
    location : Text;
    solveCount : Nat;
    simplexCount : Nat;
    dualSimplexCount : Nat;
    cuttingPlaneCount : Nat;
  };

  let userActivity = Map.empty<Principal, UserActivity>();

  // Called whenever a user logs in — auto-registers the user
  public shared ({ caller }) func recordLogin(location : Text) : async () {
    if (caller.isAnonymous()) { return };
    ensureRegistered(caller);
    let now = Time.now();
    switch (userActivity.get(caller)) {
      case (null) {
        userActivity.add(caller, {
          principal = caller;
          firstSeen = now;
          lastLogin = now;
          visitCount = 1;
          location;
          solveCount = 0;
          simplexCount = 0;
          dualSimplexCount = 0;
          cuttingPlaneCount = 0;
        });
      };
      case (?existing) {
        userActivity.add(caller, {
          existing with
          lastLogin = now;
          visitCount = existing.visitCount + 1;
          location;
        });
      };
    };
  };

  public shared ({ caller }) func recordSolve(method : Text) : async () {
    if (caller.isAnonymous()) { return };
    ensureRegistered(caller);
    if (method != "simplex" and method != "dual" and method != "cutting-plane") {
      Runtime.trap("Invalid method: must be 'simplex', 'dual', or 'cutting-plane'");
    };
    let now = Time.now();
    switch (userActivity.get(caller)) {
      case (null) {
        userActivity.add(caller, {
          principal = caller;
          firstSeen = now;
          lastLogin = now;
          visitCount = 1;
          location = "";
          solveCount = 1;
          simplexCount = if (method == "simplex") { 1 } else { 0 };
          dualSimplexCount = if (method == "dual") { 1 } else { 0 };
          cuttingPlaneCount = if (method == "cutting-plane") { 1 } else { 0 };
        });
      };
      case (?existing) {
        userActivity.add(caller, {
          existing with
          solveCount = existing.solveCount + 1;
          simplexCount = existing.simplexCount + (if (method == "simplex") { 1 } else { 0 });
          dualSimplexCount = existing.dualSimplexCount + (if (method == "dual") { 1 } else { 0 });
          cuttingPlaneCount = existing.cuttingPlaneCount + (if (method == "cutting-plane") { 1 } else { 0 });
        });
      };
    };
  };

  public query ({ caller }) func getAllUserActivity() : async [UserActivity] {
    if (not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can view all activity");
    };
    userActivity.values().toArray();
  };

  public query ({ caller }) func getUserActivity(user : Principal) : async ?UserActivity {
    if (not isCustomAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can view activity");
    };
    userActivity.get(user);
  };
};
