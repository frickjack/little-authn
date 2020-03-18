# TL;DR

A simple OIDC based process for authenticating
access to a REST API by a web application.

## OIDC Authentication

The OIDC flow is simply one step of an application's authentication process.

* Authenticate client with the identity provider, and associate the identity with the session.
* Establish a secure session with a client

## Identity Token in Cookie

Just stick the identity token in a cookie.

Disadvantages:

* no straight forward mechanism for invalidating - have to expire all tokens
* no auditing outside of logs

Advantages:

* stateless

## Rotating Session Token and Access Token Cookie

Advantages:

* expiring tokens
* audit log
* revoking tokens

Disadvantages:

* stateful
