const { ApolloServer, UserInputError, gql } = require('apollo-server')
require('dotenv').config()
const mongoose = require('mongoose')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

const uuid = require('uuid/v1')

mongoose.set('useFindAndModify', false)

const url = process.env.MONGODB_URI

const jwt = require('jsonwebtoken')

const JWT_SECRET = 'NEED_HERE_A_SECRET_KEY'



console.log('connecting to', url)

mongoose.connect(url, { 
    useUnifiedTopology: true,
    useNewUrlParser: true, 
    useCreateIndex: true,
    })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })


const typeDefs = gql`
  
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
  }

  type Author {
      name: String!
      born: Int
      id: ID!
      bookCount: Int!
  }
  type Book {
      title: String!
      published: Int!
      author: Author!
      genres: [String!]!
      id: ID!
     
  }
  type Query {
      authorCount: Int!
      allAuthors: [Author!]
      findAuthor(name: String!): Author
      allBooks(genre: String, author: String): [Book!]
      findBook(title: String!): Book
      me: User
  }
  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]
    ): Book
    editAuthor(
        name: String!
        setBornTo: Int!
      ): Author
    createUser(
        username: String!
        favoriteGenre: String!
      ): User
    login(
        username: String!
        password: String!
      ): Token
  }
`

const resolvers = {
  Query: {
    authorCount: () => Author.collection.countDocuments(),
    allAuthors: (root, args) => {
        return  Author.find({})
        
    },
    findAuthor: async (root, args) => {
       console.log(args.name + 'args name')
       const foundAuthor = await Author.findOne({ name: args.name })
       console.log(foundAuthor)
       return foundAuthor
    },
    allBooks:  (root, args) => {
       console.log(args, 'args')
         
         return Book.find({}).populate('author')
       
       
       
    },
    me: (root, args, context) => {
        return context.currentUser
    }
  },
  Author: {
     
      bookCount: (root, args) => {
        console.log(root + 'root')
        console.log(args + 'args')
        const count = Book.collection.countDocuments({ author: root._id })
        console.log(count + 'count')
        return count
      }
  }, 
  Book: {
    author:  (root, args) => {
        
        console.log(root)
        return root.author
        
        
    }
  }, 
  Mutation: {
      addBook: async(root, args, context) => {
        
        console.log(args, 'args')
        console.log(context, 'coontext')

        const currentUser = context.currentUser
        
        if (!currentUser) {
            throw new AuthenticationError("not authenticated")
          }
          
        let author = await Author.findOne({ name: args.author})
        console.log('author', author)
       
        if (author === null || author === undefined) {    
            if (args.author < 4) {
                throw new UserInputError('Name of the author is too short', {
                  invalidArgs: args.name,
                })
              }
            
            author = new Author(
              {
                name: args.author,
                born: null
              }
            )
            try {
                author.save()
                await currentUser.save()
            console.log(author + 'new author') 
            } catch (error) {
                throw new UserInputError(error.message, {
                    invalidArgs: args,
                })
            }
        }
        if (args.title.lenght < 2) {
            throw new UserInputError('Title of the book is too short', {
              invalidArgs: args.name,
            })
          }
        const book = new Book({ ...args, author: author._id })
                
          console.log('new book', book)
            
            try {
                await book.save()
                console.log('new book', book)
            } catch (error) {
                throw new UserInputError(error.message, {
                    invalidArgs: args,
                })
            }
            return book
      }, 
      editAuthor: async (root, args, context) => {
        console.log('args', args)
        const findTheId = await Author.findOne({ name: args.name})
        const currentUser = context.currentUser
        if (!currentUser) {
            throw new AuthenticationError("not authenticated")
        }

        const authorWithBorn = {
            name: args.name,
            born: Number(args.setBornTo),
            id: findTheId._id
        }
        console.log(authorWithBorn, 'authorWithBorn')

        const updatedAuthor =  await Author.findByIdAndUpdate(findTheId._id, authorWithBorn)
        console.log(updatedAuthor)
        return updatedAuthor
      },
      createUser: (root, args) => {
        const user = new User({ 
            username: args.username,
            favoriteGenre: args.favoriteGenre 
        })

        return user.save()
          .catch(error => {
            throw new UserInputError(error.message, {
              invalidArgs: args,
            })
          })
      },
      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })

        if ( !user || args.password !== 'secret' ) {
          throw new UserInputError("wrong credentials")
        }
    
        const userForToken = {
          username: user.username,
          id: user._id,
        }
    
        return { value: jwt.sign(userForToken, JWT_SECRET) }
      },
     
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  }
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})