# TL;DR

[OpenId Connect]() (OIDC) is a set of standards for the interactions between and identity provider (idp) and a client who wants to authenticate a user.  [Cognito](https://aws.amazon.com/cognito/) is an AWS service that provides applications with authentication services like user management and idp multiplexing.

## Cognito Services

### User management

Cognito maintains a database of authenticated users) and identity provider management.

### Idp management

Cognito acts as an OIDC idp that can implement its own user authentication methods (password management, multifactor authentication, e-mail and SMS verification, new user onboarding, ...), and can also allows a user to authenticate with various external identity providers (corporate SAML idp, other OIDC idp's including Microsoft, Google, Apple, and Amazon).

### Our Requirements

#### Identity Providers and Automatic Signin

Allow users to sign in with Google, etc identity providers ...

#### Users in Groups

Put users in groups, so apps can authorize based on group membership.

#### Service Accounts

#### Authenticating Clients

An OIDC client must have a mechanism for authenticating its clients in turn.  For a webapp - this can be accomplished by simply passing the identity token through as an secure and http-only cookie.  We generally prefer to not make the authn credential directly available to javascript to guard against cross site scripting attacks, and just general buggy software passing a secret around where it should not be passed.

#### SSO

The idea of single sign on is that an enterprise (or SAAS provider) can publish a series of apps with a shared identity provider, so that a client only needs to authenticate once to access any app in the suite.
