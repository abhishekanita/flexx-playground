class ExitHandler {
	public async handleExit(code: number, timeout = 5000): Promise<void> {
		try {
			console.log(`Attempting a graceful shutdown with code ${code}`);

			setTimeout(() => {
				console.log(`Forcing a shutdown with code ${code}`);
				process.exit(code);
			}, timeout).unref();

			console.log(`Exiting gracefully with code ${code}`);
			process.exit(code);
		} catch (error) {
			console.log("Error shutting down gracefully");
			logger.error(error);
			console.log(`Forcing exit with code ${code}`);
			process.exit(code);
		}
	}
}

export const exitHandler = new ExitHandler();
