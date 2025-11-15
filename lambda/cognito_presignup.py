import json
import os
from typing import Any, Dict

# Get whitelist from environment (comma-separated emails)
WHITELIST_EMAILS = os.environ.get('WHITELIST_EMAILS', '').split(',')
WHITELIST_EMAILS = [email.strip().lower() for email in WHITELIST_EMAILS if email.strip()]


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Cognito pre-sign-up trigger to validate user email against whitelist.
    
    Args:
        event: Cognito pre-sign-up event containing userAttributes
        context: Lambda context
    
    Returns:
        Cognito event with autoConfirmUser and autoVerifiedUserAttributes set
    """
    print(f"Pre-sign-up event: {json.dumps(event)}")
    
    user_email = event.get('request', {}).get('userAttributes', {}).get('email', '').lower()
    
    if not user_email:
        raise Exception("Email attribute is required")
    
    # Check if email is in whitelist
    if WHITELIST_EMAILS and user_email not in WHITELIST_EMAILS:
        raise Exception(f"Email {user_email} is not whitelisted for signup")
    
    # Auto-confirm user and verify email
    event['response']['autoConfirmUser'] = True
    event['response']['autoVerifiedUserAttributes'] = ['email']
    
    print(f"User {user_email} approved for signup")
    return event
