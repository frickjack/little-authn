# TL;DR

Setting up [cognito](https://aws.amazon.com/cognito/) the first time is a little daunting.  This document walks through the process.

## Overview

Before building your first cognito identity provider, make sure you understand the core OIDC concepts and the cognito model for implementing them explained [here](../explanation/introToOidcAndCognito.md).

We use the `little` helper script to deploy a [cloudformation](https://aws.amazon.com/cloudformation/) stack that defines our cognito infrastructure.