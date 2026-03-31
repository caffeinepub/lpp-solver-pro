import AccessControl "./access-control";
import Prim "mo:prim";
import Runtime "mo:core/Runtime";

mixin (accessControlState : AccessControl.AccessControlState) {
  // Initialize auth or claim admin if token matches.
  // If admin not yet assigned and token is correct, caller becomes admin.
  // If caller already has a role but token is correct and no admin assigned yet, still promote.
  // If admin already assigned, only the correct token re-assigns admin to caller.
  public shared ({ caller }) func _initializeAccessControlWithSecret(userSecret : Text) : async () {
    switch (Prim.envVar<system>("CAFFEINE_ADMIN_TOKEN")) {
      case (null) {
        Runtime.trap("CAFFEINE_ADMIN_TOKEN environment variable is not set");
      };
      case (?adminToken) {
        if (caller.isAnonymous()) { return };
        if (userSecret == adminToken) {
          // Token is correct — grant admin regardless of previous state
          accessControlState.userRoles.add(caller, #admin);
          accessControlState.adminAssigned := true;
        } else {
          // Wrong token — register as user if not yet registered
          switch (accessControlState.userRoles.get(caller)) {
            case (?_) {}; // already registered, do nothing
            case (null) {
              accessControlState.userRoles.add(caller, #user);
            };
          };
        };
      };
    };
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    // Admin-only check happens inside
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    if (caller.isAnonymous()) { return false };
    switch (accessControlState.userRoles.get(caller)) {
      case (?(#admin)) { true };
      case (_) { false };
    };
  };
};
