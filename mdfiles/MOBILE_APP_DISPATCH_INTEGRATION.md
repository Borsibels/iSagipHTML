# Mobile App Dispatch Integration Guide

This guide explains how to implement dispatch notifications in your mobile responder app so responders are notified when they've been assigned to an emergency.

## Overview

When barangay staff assigns responders to a report, the system creates assignment entries in Firebase Realtime Database. Your mobile app should listen to these assignments to notify responders in real-time.

## Database Structure

### Assignments Path
```
assignments/{responderUid}/{assignmentId}
```

Each assignment contains:
```json
{
  "assignmentId": "report123_responder456_1234567890",
  "reportId": "report123",
  "responderUid": "responder456",
  "status": "pending",
  "type": "Medical Emergency",
  "description": "Patient needs immediate medical attention",
  "address": "123 Main Street",
  "landmark": "Near the park",
  "latitude": 14.5995,
  "longitude": 120.9842,
  "assignedVehicle": "AMB-001",
  "note": "Bring medical supplies",
  "dispatchedBy": "John Doe",
  "dispatchedAt": 1234567890,
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

### Assignment Status Values
- `pending` - Newly assigned, responder hasn't responded yet
- `accepted` - Responder accepted the assignment
- `en_route` - Responder is on the way
- `arrived` - Responder arrived at the location
- `completed` - Assignment completed

## Implementation Steps

### 1. Listen for New Assignments

In your mobile app, listen to assignments for the logged-in responder:

```javascript
// Firebase Realtime Database setup
import { getDatabase, ref, onValue, off } from 'firebase/database';

const db = getDatabase();
const responderUid = currentUser.uid; // Get from Firebase Auth
const assignmentsRef = ref(db, `assignments/${responderUid}`);

// Listen for new assignments
onValue(assignmentsRef, (snapshot) => {
  const assignments = snapshot.val() || {};
  
  Object.keys(assignments).forEach(assignmentId => {
    const assignment = assignments[assignmentId];
    
    // Check if this is a new assignment (status is 'pending')
    if (assignment.status === 'pending') {
      // Show notification to responder
      showDispatchNotification(assignment);
    }
  });
});
```

### 2. Show Notification to Responder

When a new assignment is received, show a notification:

```javascript
function showDispatchNotification(assignment) {
  // Show local notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Emergency Dispatch', {
      body: `${assignment.type} - ${assignment.address}`,
      icon: '/icon.png',
      badge: '/badge.png',
      tag: assignment.assignmentId,
      requireInteraction: true
    });
  }
  
  // Show in-app notification/modal
  showInAppNotification(assignment);
  
  // Play sound/vibration
  playAlertSound();
  navigator.vibrate([200, 100, 200]); // Vibrate pattern
}

function showInAppNotification(assignment) {
  // Create a modal or alert showing:
  // - Emergency type
  // - Location (address + landmark)
  // - GPS coordinates
  // - Assigned vehicle
  // - Notes/instructions
  // - Accept/Decline buttons
}
```

### 3. Update Assignment Status

When responder accepts or updates their status:

```javascript
import { getDatabase, ref, update } from 'firebase/database';

async function updateAssignmentStatus(assignmentId, responderUid, newStatus) {
  const db = getDatabase();
  const assignmentRef = ref(db, `assignments/${responderUid}/${assignmentId}`);
  
  await update(assignmentRef, {
    status: newStatus,
    updatedAt: Date.now()
  });
}

// Example: Responder accepts assignment
await updateAssignmentStatus(assignmentId, responderUid, 'accepted');

// Example: Responder is en route
await updateAssignmentStatus(assignmentId, responderUid, 'en_route');

// Example: Responder arrived
await updateAssignmentStatus(assignmentId, responderUid, 'arrived');
```

### 4. Handle Assignment Actions

```javascript
// Accept assignment
async function acceptAssignment(assignment) {
  await updateAssignmentStatus(assignment.assignmentId, assignment.responderUid, 'accepted');
  // Navigate to map/directions view
  navigateToLocation(assignment.latitude, assignment.longitude);
}

// Decline assignment (optional - may need to notify staff)
async function declineAssignment(assignment) {
  await updateAssignmentStatus(assignment.assignmentId, assignment.responderUid, 'declined');
  // Notify staff that responder declined
}
```

### 5. Listen for Assignment Updates

You may also want to listen for updates to existing assignments:

```javascript
// Listen to specific assignment
const assignmentRef = ref(db, `assignments/${responderUid}/${assignmentId}`);
onValue(assignmentRef, (snapshot) => {
  const assignment = snapshot.val();
  if (assignment) {
    // Update UI with latest assignment data
    updateAssignmentUI(assignment);
  }
});
```

## Complete Example (React Native / JavaScript)

```javascript
import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, off, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';

function useDispatchNotifications() {
  const [assignments, setAssignments] = useState({});
  const [newAssignments, setNewAssignments] = useState([]);
  
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) return;
    
    const db = getDatabase();
    const assignmentsRef = ref(db, `assignments/${user.uid}`);
    
    const unsubscribe = onValue(assignmentsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setAssignments(data);
      
      // Find new pending assignments
      const pending = Object.values(data).filter(
        a => a.status === 'pending'
      );
      setNewAssignments(pending);
      
      // Show notifications for new assignments
      pending.forEach(assignment => {
        showNotification(assignment);
      });
    });
    
    return () => {
      off(assignmentsRef);
    };
  }, []);
  
  const acceptAssignment = async (assignmentId) => {
    const auth = getAuth();
    const user = auth.currentUser;
    const db = getDatabase();
    
    await update(
      ref(db, `assignments/${user.uid}/${assignmentId}`),
      {
        status: 'accepted',
        updatedAt: Date.now()
      }
    );
  };
  
  return { assignments, newAssignments, acceptAssignment };
}
```

## Push Notifications (Optional)

For background notifications when app is closed, use Firebase Cloud Messaging (FCM):

1. Set up FCM in your mobile app
2. Send push notifications from backend when assignments are created
3. Handle notification tap to open app and show assignment details

## Best Practices

1. **Always check assignment status** - Don't show duplicate notifications for the same assignment
2. **Handle offline scenarios** - Cache assignments locally and sync when online
3. **Update location** - Continuously update responder location in `responders/{responderUid}` path
4. **Error handling** - Handle cases where assignment data might be incomplete
5. **Cleanup** - Remove old/completed assignments from local storage

## Testing

1. Assign a responder through the web dashboard
2. Check that assignment appears in `assignments/{responderUid}` path
3. Verify mobile app receives and displays notification
4. Test accepting/updating assignment status
5. Verify status updates reflect in web dashboard

## Support

For questions or issues, contact the development team.
