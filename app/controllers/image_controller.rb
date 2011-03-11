require "open-uri"

class ImageController < ApplicationController
    def show
        b64 = ["data:"]
        open(params[:url]) do |io|
            b64.push io.content_type
            b64.push ";base64,"
            b64.push ActiveSupport::Base64.encode64(io.read)
        end

        render :text => b64.join
    end
end