# Neo4j - NodeJS Api (with REST)

*Please note that code is currently in transition from ES5 to ES6 style.*

## Prequisites

A neo4j graph database instance is required to provide the persistence layer. You can download this from the neo4j website http://neo4j.com/.

## Usage

The Api provides high level CRUD methods for neo4j nodes and relationships. It can be used via REST or directly referenced from an existing NodeJS application.

For example, the following JSON structure:

```javascript
{ 
  label: 'George', 
  colour: 'Brown', 
  type: 'Elephant', 
  labels: ['Animal','Large'],
  relationships: {
                'loves': {
                            predicate: {
                                lookup: 'loves',
                                direction: 'out'
                            },
                        'items': [{label: 'Apple'}]
                    },
                 'fed by': {
                        predicate: {
                            lookup: 'feeds',
                            direction: 'in'
                    },
                        'items': [{label: 'Jim'}]
                    }
            }
}
            
```

passed to ``node.save`` will generate cypher which will be sent to neo4j to generate the corresponding nodes and relationships.

## Predicates

As there is no support for relationship types in neo4j (as of version 2) the Api provides a layer of logic that enables relationship types to be stored in the database as *Predicate* nodes. Relationship types can then be given metadata where applicable, such as ``Symmetrical (true/false)``, ``Force: (attract/repel)``.

## Labels

Neo4j provides the ability to apply labels to nodes as a way of grouping portions of the graph. Labels can be anything, but lend themselves well to describing characteristics of nodes. As such, a node could be said to be defined by the combination of its labels. The Api provides a layer of logic on to enable properties to be defined against labels. The node's schema is then an aggragate of the properties of its labels.

## Collaborate

If you are interested in this project it would be great to have your contribution, so don't hesitate to dive in or get in touch. Thanks !