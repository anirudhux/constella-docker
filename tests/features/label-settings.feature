Feature: Label settings
  As a user presenting a graph
  I want to control label density and size
  So that the graph is legible for the context

  Background:
    Given a graph is open
    And I have opened "Settings"

  @smoke
  Scenario: Three label modes are available
    Then the "Labels" mode offers "Smart", "Parents only", and "All"
    And "Smart" is described as "Show what fits"
    And "Parents only" is described as "Top two levels"
    And "All" is described as "Every node"

  # @wip: asserting the *number of visible labels* requires reading the WebGL
  # label overlay after a render settle — deferred to a renderer-hooked pass.
  @regression @wip
  Scenario Outline: Changing label mode changes how many labels show
    When I select label mode "<mode>"
    Then the number of visible labels matches "<expectation>"

    Examples:
      | mode         | expectation                         |
      | Parents only | only the top two levels are labeled |
      | Smart        | only labels that fit are shown      |
      | All          | every node is labeled               |

  Scenario: Text size slider changes label size
    When I move the "Text size" slider toward the larger end
    Then the label text becomes larger
    When I move the "Text size" slider toward the smaller end
    Then the label text becomes smaller

  @expected
  Scenario: Selected settings apply immediately to the open graph
    When I change any label setting
    Then the change is reflected on the graph without a page reload
