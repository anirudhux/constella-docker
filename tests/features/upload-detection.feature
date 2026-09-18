Feature: File upload turns structured data into a graph
  As a user with a structured file
  I want Constella to render it without a review gate
  So that I get to the graph directly

  Background:
    Given I am on the landing page

  @smoke @regression
  Scenario: Uploading a clear CSV renders the graph — no review gate
    When I upload a CSV file with hierarchy columns and metadata columns
    Then the graph workspace opens
