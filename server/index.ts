import 'dotenv/config';

import Fastify from "fastify";
interface RequestWithSessionUser {
	sessionUser: any;
}
import path from "path";
import { createReadStream, readFileSync } from "fs";
import sessionAuthMiddleware, { firebaseConfig } from "./services/SessionService";
import signupRoute from "./routes/signup.route";

// HTTPS was only needed for testing with plaid
// // HTTPS support for development
// const isDevelopment = process.env.NODE_ENV === 'development';
// const httpsOptions = isDevelopment ? {
//     key: readFileSync(path.join(__dirname, 'certs/localhost+2-key.pem')),
//     cert: readFileSync(path.join(__dirname, 'certs/localhost+2.pem'))
// } : {};

const app = Fastify({
	logger: false,
	// https: httpsOptions
});
app.register(require('@fastify/cors'), {
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

app.get('/firebase-config', () => {
	return {
		data: firebaseConfig
	}
});

// Signup routes
app.register(signupRoute, { prefix: '/signup' });

app.addHook('onResponse', (request, reply) => {
	const sign = reply.statusCode >= 200 && reply.statusCode < 300 ? '✅' : '❌';
	console.log(`${sign} ${reply.statusCode} - ${request.method} ${request.url}`);
});

// unauthenticated routes
app.register((api, _, done) => {
	api.register(require('./routes/facility.route'), { prefix: '/facility' });

	done();
}, { prefix: '/api' });

// authenticated routes
app.register((api, _, done) => {
	api.addHook('preValidation', sessionAuthMiddleware);

	api.register(require('./routes/user.route'), { prefix: '/user' });

	api.setNotFoundHandler((req, reply) => {
		reply.status(404).send({ message: 'Not Found' });
	})


	// admin routes
	app.register((api, _, done) => {
		// First check if user has admin privilege - run after session auth
		api.addHook('preValidation', (request: any, reply, done): void => {
			const user = request.sessionUser;
			if (!user.isAdmin) {
				reply.status(403).send({ message: 'Access denied: Admin privileges required' });
				done();
				return;
			}
			done();
		});

		api.get('/', (request, reply) => {
			return {
				success: true,
				message: 'Admin API',
				data: {}
			}
		});

		api.register(require('./routes/facility.admin.route'), { prefix: '/facility' });

		done();
	}, { prefix: '/admin' });

	done();
}, { prefix: '/api' });


// Serving the static app in PROD
app.register(require('@fastify/static'), {
	root: path.join(__dirname, '../dist'),
});
app.setNotFoundHandler((req, reply) => {
	const stream = createReadStream(path.join(__dirname, '../dist') + '/index.html'); // for app sub-routing
	reply.type('text/html').send(stream)
})

app.setErrorHandler((error: any, request, reply) => {
	console.error('\nError: ', error)
	if (error.isApiError) {
		throw error;
	}
	reply.status(500).send({
		message: "Internal Server Error"
	});
});

// Run the server!
(async () => {
	try {
		const port = Number(process.env.PORT || 5000);
		const host = `0.0.0.0`; // Listen on all interfaces to allow external connections
		await app.listen({ port, host });
		console.log(`Server started and listening on ${host}:${port}`)
	} catch (err) {
		console.error(err)
		process.exit(1)
	}
})();
