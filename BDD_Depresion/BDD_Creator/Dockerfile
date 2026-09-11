# Use an official PHP runtime as a parent image
FROM php:8.3-apache

# Set the working directory in the container to /var/www/html
WORKDIR /var/www/html

# Copy the current directory contents into the container at /var/www/html
COPY . /var/www/html

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install system packages and the PDO MySQL extension
# unzip is required by composer to extract downloaded packages
RUN apt-get update && apt-get install -y unzip default-mysql-client \
    && docker-php-ext-install pdo_mysql \
    && rm -rf /var/lib/apt/lists/*

# Install any needed packages specified in composer.json
RUN composer install --no-dev

# Expose port 80 to the outside world
EXPOSE 80

# Run the built-in web server
CMD ["apache2-foreground"]
