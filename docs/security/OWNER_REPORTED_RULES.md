# Owner-reported rules transcript

Source: policy text supplied by the owner for `workout-companion-d078f`. This transcript is documentation, not a deployment configuration. Markdown fence markers around the inner section were removed for readability; the supplied statements are preserved. Two outer closing braces are missing from the pasted text and have not been invented here. A complete export must be reconciled and emulator-tested before deployment.

```text
// firestore.rules
rules_version = '2';

service cloud.firestore {
match /databases/{database}/documents {
function isSignedIn() {
return request.auth != null;
}

function isSelf(userId) {
  return isSignedIn() && request.auth.uid == userId;
}

function isGroupMember(groupId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
}

function isGroupOwner(groupId) {
  return isSignedIn() &&
    get(/databases/$(database)/documents/groups/$(groupId)).data.createdBy == request.auth.uid;
}

// Users collection
match /users/{userId} {
  // DEV: allow authenticated reads for profile display in chat/member screens.
  // PROD: restrict to isSelf(userId) or move public profile fields into a separate collection.
  allow read: if isSignedIn();
  allow create, update, delete: if isSelf(userId);

  match /groups/{groupId} {
    allow read, write: if isSelf(userId);
  }

  match /workouts/{workoutId} {
    // DEV: allow authenticated reads so members can view each other's workouts.
    // PROD: move shared workouts under /groups/{groupId}/workouts or store groupId on workouts.
    allow read: if isSignedIn();
    allow create: if isSelf(userId)
      && request.resource.data.userId == userId
      && request.resource.data.keys().hasAll([
        "userId",
        "groupId",
        "performedAt",
        "createdAt"
      ]);
    allow update, delete: if isSelf(userId);
  }

  match /notifications/{notificationId} {
    allow read: if isSelf(userId);
    // DEV: allow group members to fan out notifications to each other.
    // PROD: move fanout to Cloud Functions or enforce stricter validation.
    allow create: if isSignedIn() &&
      request.resource.data.userId == userId &&
      request.resource.data.actorUserId == request.auth.uid &&
      isGroupMember(request.resource.data.groupId);
    allow update, delete: if isSelf(userId);
  }

  match /private/{docId} {
    allow read, write: if isSelf(userId);
  }
}

// Groups collection
match /groups/{groupId} {
  // DEV: allow any signed-in user to read group metadata (invite code lookup).
  // PROD: change to "allow read: if isGroupMember(groupId);"
  allow read: if isSignedIn();
  allow create: if isSignedIn();
  allow update, delete: if isGroupOwner(groupId);

  match /members/{memberId} {
    allow read: if isGroupMember(groupId);
    allow create: if isSelf(memberId);
    allow update, delete: if isSelf(memberId) || isGroupOwner(groupId);
  }

  match /messages/{messageId} {
    allow read: if isGroupMember(groupId);
    allow create: if isGroupMember(groupId) &&
      request.resource.data.userId == request.auth.uid;
    allow update, delete: if isGroupMember(groupId) &&
      request.resource.data.userId == request.auth.uid;
  }

  match /goals/{userId} {
    allow read: if isGroupMember(groupId);
    allow create, update, delete: if isSelf(userId);
  }
}
```
